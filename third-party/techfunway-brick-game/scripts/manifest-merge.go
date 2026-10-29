// 多架构 manifest 合并工具：将已推送的两个单架构 tag 合并为 manifest list
// （docker pull 时按目标机器架构自动选择），并顺带把源镜像 config 的
// architecture 字段修正为目标架构（传统构建器离线产出的镜像会按构建机盖章）。
//
// 全部 registry 请求走 HTTP(S)_PROXY（如 OrbStack 内置代理 proxy.orb.internal:8305），
// 用于本机到 docker.io 的 DNS/链路被污染而 dockerd 通道可用的环境。
//
// 环境变量：
//
//	REPO        镜像仓库（默认 techfunways/brick-game）
//	VERSION     版本 tag（默认 v0.1.0）；源为 $VERSION(期望 arm64) 与 $VERSION-amd64(期望 amd64)
//	TARGET_TAGS 合并结果写入的 tag，逗号分隔（默认 $VERSION,latest）
//	DH_USER / DH_PASS  Docker Hub 凭据（PAT）
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

var (
	repo           = envOr("REPO", "techfunways/brick-game")
	version        = envOr("VERSION", "v0.1.0")
	regURL         = "https://registry-1.docker.io"
	manifestAccept = "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json"
)

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

type platform struct {
	Architecture string `json:"architecture"`
	OS           string `json:"os"`
}

type descriptor struct {
	MediaType string   `json:"mediaType"`
	Size      int64    `json:"size"`
	Digest    string   `json:"digest"`
	Platform  platform `json:"platform"`
}

type client struct {
	http  *http.Client
	token string
}

func (c *client) get(ref, accept string) ([]byte, string, error) {
	req, _ := http.NewRequest("GET", regURL+"/v2/"+repo+"/"+ref, nil)
	req.Header.Set("Authorization", "Bearer "+c.token)
	if accept != "" {
		req.Header.Set("Accept", accept)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", err
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, "", fmt.Errorf("GET %s: http %d: %s", ref, resp.StatusCode, body[:min(len(body), 200)])
	}
	return body, resp.Header.Get("Content-Type"), nil
}

func (c *client) putManifest(ref string, body []byte, mediaType string) error {
	req, _ := http.NewRequest("PUT", regURL+"/v2/"+repo+"/manifests/"+ref, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", mediaType)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	b, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("PUT %s: http %d: %s", ref, resp.StatusCode, b[:min(len(b), 200)])
	}
	return nil
}

// putBlob 上传 blob（config 等小对象），返回其 digest
func (c *client) putBlob(content []byte) (string, error) {
	sum := sha256.Sum256(content)
	digest := "sha256:" + hex.EncodeToString(sum[:])
	init, _ := http.NewRequest("POST", regURL+"/v2/"+repo+"/blobs/uploads/", nil)
	init.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.http.Do(init)
	if err != nil {
		return "", err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 202 {
		return "", fmt.Errorf("blob upload init: http %d", resp.StatusCode)
	}
	loc := resp.Header.Get("Location")
	if !strings.HasPrefix(loc, "http") {
		loc = regURL + loc
	}
	sep := "?"
	if strings.Contains(loc, "?") {
		sep = "&"
	}
	req, _ := http.NewRequest("PUT", loc+sep+"digest="+digest, bytes.NewReader(content))
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/octet-stream")
	presp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	io.Copy(io.Discard, presp.Body)
	presp.Body.Close()
	if presp.StatusCode >= 300 {
		return "", fmt.Errorf("blob upload put: http %d", presp.StatusCode)
	}
	return digest, nil
}

func isIndexCT(ct string) bool {
	return strings.Contains(ct, "manifest.list.v2+json") || strings.Contains(ct, "image.index.v1+json")
}

// ensureArch 保证 ref 指向的 manifest 所含镜像的 config 架构为 wantArch。
// 若 config 架构不符，上传修正后的 config blob 并原位重写 manifest（其余字段无损保留）；
// 若 ref 是清单，则递归修正目标架构子项后重建清单（unknown 平台的 attestation 条目顺带丢弃）。
// 返回指向（已修正的）目标架构 image manifest 的 descriptor。
func (c *client) ensureArch(ref, wantArch string) (descriptor, error) {
	body, ct, err := c.get("manifests/"+ref, manifestAccept)
	if err != nil {
		return descriptor{}, err
	}
	ct = ctClear(ct)

	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return descriptor{}, err
	}
	manifests, hasManifests := raw["manifests"].([]interface{})
	if isIndexCT(ct) || hasManifests {
		// 清单：目标架构子项递归修正；unknown 平台为 attestation（丢弃）；
		// 其余架构条目原样保留
		changed := false
		newDescs := make([]descriptor, 0, len(manifests))
		for _, mi := range manifests {
			d, ok := mi.(map[string]interface{})
			if !ok {
				continue
			}
			descBytes, _ := json.Marshal(d)
			var desc descriptor
			json.Unmarshal(descBytes, &desc)
			if desc.Platform.Architecture == "unknown" {
				continue
			}
			if desc.Platform.Architecture != wantArch {
				newDescs = append(newDescs, desc)
				continue
			}
			fixedDesc, err := c.ensureArch(desc.Digest, wantArch)
			if err != nil {
				return descriptor{}, fmt.Errorf("index 子项 %s: %w", desc.Digest, err)
			}
			newDescs = append(newDescs, fixedDesc)
			changed = changed || fixedDesc.Digest != desc.Digest
		}
		var want *descriptor
		for i := range newDescs {
			if newDescs[i].Platform.Architecture == wantArch {
				want = &newDescs[i]
				break
			}
		}
		if want == nil {
			return descriptor{}, fmt.Errorf("清单中未找到 %s 架构条目", wantArch)
		}
		if changed {
			raw["manifests"] = newDescs
			if mt, ok := raw["mediaType"].(string); !ok || mt == "" {
				raw["mediaType"] = ct
			}
			nb, _ := json.Marshal(raw)
			if err := c.putManifest(ref, nb, ct); err != nil {
				return descriptor{}, err
			}
			fmt.Printf("已重写清单 %s（修正 %s 条目）\n", ref, wantArch)
		}
		return *want, nil
	}

	// image manifest：校验并按需改写 config 架构
	cfgDesc, _ := raw["config"].(map[string]interface{})
	if cfgDesc == nil || cfgDesc["digest"] == "" || strings.Contains(fmt.Sprint(cfgDesc["mediaType"]), "in-toto") {
		return descriptor{}, fmt.Errorf("%s 不是可识别的 image manifest", ref)
	}
	cfgBody, _, err := c.get("blobs/"+cfgDesc["digest"].(string), "")
	if err != nil {
		return descriptor{}, err
	}
	var cfg map[string]interface{}
	if err := json.Unmarshal(cfgBody, &cfg); err != nil {
		return descriptor{}, err
	}
	cur, _ := cfg["architecture"].(string)
	if cur == wantArch {
		sum := sha256.Sum256(body)
		return descriptor{MediaType: ct, Size: int64(len(body)), Digest: "sha256:" + hex.EncodeToString(sum[:]), Platform: platform{Architecture: wantArch}}, nil
	}
	fmt.Printf("%s: config architecture %q → %q（远端修正）\n", ref, cur, wantArch)
	cfg["architecture"] = wantArch
	cfg["os"] = "linux"
	newCfg, _ := json.Marshal(cfg)
	newCfgDigest, err := c.putBlob(newCfg)
	if err != nil {
		return descriptor{}, fmt.Errorf("上传修正后的 config: %w", err)
	}
	cfgDesc["digest"] = newCfgDigest
	cfgDesc["size"] = len(newCfg)
	raw["config"] = cfgDesc
	raw["schemaVersion"] = 2
	if mt, ok := raw["mediaType"].(string); !ok || mt == "" {
		raw["mediaType"] = ct
	}
	mb, _ := json.Marshal(raw)
	if err := c.putManifest(ref, mb, ct); err != nil {
		return descriptor{}, err
	}
	sum := sha256.Sum256(mb)
	return descriptor{MediaType: ct, Size: int64(len(mb)), Digest: "sha256:" + hex.EncodeToString(sum[:]), Platform: platform{Architecture: wantArch}}, nil
}

func ctClear(ct string) string {
	// Content-Type 可能带参数（; charset=...），清掉
	if i := strings.Index(ct, ";"); i >= 0 {
		return strings.TrimSpace(ct[:i])
	}
	return ct
}

func main() {
	user, pass := os.Getenv("DH_USER"), os.Getenv("DH_PASS")
	if user == "" || pass == "" {
		fmt.Println("need DH_USER/DH_PASS")
		os.Exit(1)
	}
	c := &client{http: &http.Client{}}

	// 1. token
	authURL := "https://auth.docker.io/token?service=registry.docker.io&scope=repository:" + repo + ":pull,push"
	req, _ := http.NewRequest("GET", authURL, nil)
	req.SetBasicAuth(user, pass)
	resp, err := c.http.Do(req)
	if err != nil {
		fmt.Println("token:", err)
		os.Exit(1)
	}
	tr, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		fmt.Printf("token http %d: %s\n", resp.StatusCode, tr[:200])
		os.Exit(1)
	}
	var tok struct {
		Token string `json:"token"`
	}
	json.Unmarshal(tr, &tok)
	c.token = tok.Token
	fmt.Println("token ok, len", len(tok.Token))

	// 2. 修正并收集两个架构的 descriptor
	// 源用纯架构 tag（-arm64 / -amd64），避开可能已被合并清单污染的版本 tag
	sources := []struct{ tag, arch string }{
		{version + "-arm64", "arm64"},
		{version + "-amd64", "amd64"},
	}
	var descs []descriptor
	for _, src := range sources {
		desc, err := c.ensureArch(src.tag, src.arch)
		if err != nil {
			fmt.Println(src.tag, "resolve:", err)
			os.Exit(1)
		}
		desc.Platform.OS = "linux"
		fmt.Printf("%s → %s %s size=%d arch=%s\n", src.tag, desc.MediaType, desc.Digest, desc.Size, desc.Platform.Architecture)
		descs = append(descs, desc)
	}

	// 3. 组装 manifest list 并 PUT
	list := struct {
		SchemaVersion int          `json:"schemaVersion"`
		MediaType     string       `json:"mediaType"`
		Manifests     []descriptor `json:"manifests"`
	}{2, "application/vnd.docker.distribution.manifest.list.v2+json", descs}
	lb, _ := json.Marshal(list)
	targets := []string{version, "latest"}
	if t := os.Getenv("TARGET_TAGS"); t != "" {
		targets = strings.Split(t, ",")
	}
	for _, tag := range targets {
		if err := c.putManifest(tag, lb, list.MediaType); err != nil {
			fmt.Println(tag, "PUT:", err)
			os.Exit(1)
		}
		fmt.Printf("PUT %s: 201\n", tag)
	}
	fmt.Println("MERGE OK")
}
