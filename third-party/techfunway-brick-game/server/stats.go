// Package main · stats —— 匿名使用统计与「支持作者」计数转发。
//
// 设计原则（与家族应用 reminders 的 stats 包一致，不可妥协）：
//  1. 匿名透明：只上报设备级信息（哈希标识/系统/架构/版本），不含任何用户数据；
//  2. 可退出：-disable-stats 启动参数或 DISABLE_STATS=1 环境变量完全关闭；
//  3. 上报走 HTTPS，地址可用 STATS_ENDPOINT 环境变量覆盖（本地测试指向假服务）；
//  4. 「已支持」状态以服务端结果为准：统计端点返回非 2xx 一律视为失败。
//
// 设备标识三级回退：系统机器标识 → 程序目录持久化随机 ID（容器环境）→
// hostname+os+arch 兜底。哈希原料只含应用名与机器标识，永不包含 hostname
// 原文、用户数据或可执行文件目录路径。
package main

import (
	"bytes"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// statsRequest 是统计端点的心跳/事件上报体。
type statsRequest struct {
	AppName    string  `json:"app_name"`
	Version    string  `json:"version"`
	DeviceType string  `json:"device_type"` // fnos|docker|（裸二进制为空）
	DeviceID   string  `json:"device_id"`   // 32 位 md5 哈希，永远不含原文
	OS         string  `json:"os"`
	Arch       string  `json:"arch"`
	// Event 区分上报类型：心跳不携带，支持点击为 "donate_support"
	Event string `json:"event,omitempty"`
	// Amount 支持金额（元），仅 donate_support 事件携带，用于接收端统计
	// 支持流水（app_support_log.amount）。心跳不携带。
	Amount float64 `json:"amount,omitempty"`
}

const (
	statsHeartbeatInterval = 60 * time.Minute
	statsDonateEvent       = "donate_support"
)

var (
	statsClient = &http.Client{Timeout: 5 * time.Second}
	statsMu     sync.Mutex
	statsBase   statsRequest
	statsOn     bool
	statsStop   chan struct{}
)

// statsEndpoint 返回统计上报地址。STATS_ENDPOINT 环境变量可覆盖（测试用）。
func statsEndpoint() string {
	if e := os.Getenv("STATS_ENDPOINT"); e != "" {
		return e
	}
	return "https://techfunway.wycto.cn/api/apps.online/refresh"
}

// statsInit 组装本实例的公共上报字段。statsStart = statsInit + 心跳循环。
func statsInit(appName, ver, deviceType, dataDir string) {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsBase = statsRequest{
		AppName:    appName,
		Version:    ver,
		DeviceType: deviceType,
		DeviceID:   statsDeviceID(appName, dataDir),
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
	}
}

// statsStart 启动心跳上报：启动时立即报第一次，之后每 60 分钟一次。
// 重复调用是安全的（只生效第一次）。-disable-stats 或 DISABLE_STATS=1
// 时不启动。
func statsStart(appName, ver, deviceType, dataDir string) {
	if os.Getenv("DISABLE_STATS") == "1" {
		fmt.Println("匿名使用统计已通过 DISABLE_STATS=1 关闭")
		return
	}
	statsInit(appName, ver, deviceType, dataDir)

	statsMu.Lock()
	if statsOn {
		statsMu.Unlock()
		return
	}
	statsOn = true
	statsStop = make(chan struct{})
	statsMu.Unlock()

	go func() {
		statsReport()
		ticker := time.NewTicker(statsHeartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-statsStop:
				return
			case <-ticker.C:
				statsReport()
			}
		}
	}()
}

func statsReport() {
	statsMu.Lock()
	req := statsBase
	statsMu.Unlock()
	if req.AppName == "" {
		return
	}
	body, _ := json.Marshal(req)
	resp, err := statsClient.Post(statsEndpoint(), "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("使用统计上报失败: %v\n", err)
		return
	}
	resp.Body.Close()
}

// statsDeviceID 计算设备唯一标识：机器标识优先，无标识环境退回
// 数据目录持久化 ID，最终兜底 hostname+os+arch。只上报加应用名前缀的
// md5 哈希，防止跨应用关联。
func statsDeviceID(appName, dataDir string) string {
	source := statsMachineSignature()
	if source == "" {
		source = statsPersistentID(dataDir)
	}
	return fmt.Sprintf("%x", md5.Sum([]byte(appName+"|"+source)))
}

// statsMachineSignature 读取操作系统安装时生成的机器标识。
// 卸载重装应用不会变化，仅重装系统才会改变；读取失败返回空串。
func statsMachineSignature() string {
	switch runtime.GOOS {
	case "linux":
		for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
			if b, err := os.ReadFile(p); err == nil {
				if s := strings.TrimSpace(string(b)); s != "" {
					return s
				}
			}
		}
	case "darwin":
		out, err := exec.Command("ioreg", "-rd1", "-c", "IOPlatformExpertDevice").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if !strings.Contains(line, "IOPlatformUUID") {
					continue
				}
				if i := strings.Index(line, "= \""); i >= 0 {
					return strings.Trim(line[i+3:], "\" ")
				}
			}
		}
	case "windows":
		out, err := exec.Command("reg", "query", `HKLM\SOFTWARE\Microsoft\Cryptography`, "/v", "MachineGuid").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if strings.Contains(line, "MachineGuid") {
					fields := strings.Fields(line)
					if len(fields) >= 3 {
						return fields[len(fields)-1]
					}
				}
			}
		}
	}
	return ""
}

// statsPersistentID 无系统机器标识时（常见于容器环境），在数据目录持久化
// 一个随机 ID：容器重建、主机改名后仍保持同一身份（目录随卷挂载）。
func statsPersistentID(dataDir string) string {
	path := filepath.Join(dataDir, "device.id")
	if b, err := os.ReadFile(path); err == nil {
		if s := strings.TrimSpace(string(b)); s != "" {
			return s
		}
	}
	id := fmt.Sprintf("%d-%d", time.Now().UnixNano(), os.Getpid())
	if err := os.MkdirAll(dataDir, 0o755); err == nil {
		if err := os.WriteFile(path, []byte(id), 0o600); err == nil {
			return id
		}
	}
	// 目录不可写时的最终兜底
	hostname, _ := os.Hostname()
	return hostname + runtime.GOOS + runtime.GOARCH
}

// handleDonateSupport 处理「已支持」点击：转发匿名支持计数到统计端点
// （携带金额），成功才返回 ok=true，前端据此记住当前版本不再提示。
// 支持完全自愿，金额不核验、不关联任何支付记录。
func handleDonateSupport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		fmt.Fprintf(w, `{"code":1,"message":"仅支持 POST"}`)
		return
	}
	if os.Getenv("DISABLE_STATS") == "1" {
		fmt.Fprintf(w, `{"code":1,"message":"统计上报已关闭"}`)
		return
	}
	// 支持金额（元）：可选字段，缺省为 0（不校验支付，仅作金额标注）
	var payload struct {
		Amount float64 `json:"amount"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&payload)
	}
	if payload.Amount < 0 {
		payload.Amount = 0
	}

	statsMu.Lock()
	req := statsBase
	statsMu.Unlock()
	req.Event = statsDonateEvent
	req.Amount = payload.Amount
	body, _ := json.Marshal(req)
	resp, err := statsClient.Post(statsEndpoint(), "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Fprintf(w, `{"code":1,"message":"支持计数发送失败，请稍后再试"}`)
		return
	}
	defer resp.Body.Close()
	// 统计服务返回非 2xx 视为发送失败（http.Post 不把 4xx/5xx 当作 err）
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		fmt.Fprintf(w, `{"code":1,"message":"支持计数发送失败，请稍后再试"}`)
		return
	}
	fmt.Fprintf(w, `{"code":0,"message":"ok","data":{"ok":true}}`)
}
