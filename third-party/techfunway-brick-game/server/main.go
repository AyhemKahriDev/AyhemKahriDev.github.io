// brick-game — 方块游戏机静态服务
// 基于 smallgo 基座约定：TCP 端口 + 飞牛统一网关 socket 双监听。
package main

import (
	"flag"
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "unknown"
	AppName   = "brick-game"
	// startedAt 本进程的随机运行标识：前端用它区分"本次运行"——
	// 关闭支持弹窗后，服务重启前不再弹（刷新页面不重置）。
	startedAt = fmt.Sprintf("%d-%d", time.Now().UnixNano(), os.Getpid())
)

const defaultGatewayPrefix = "/app/techfunway-brick-game"

func main() {
	port := flag.String("port", "8908", "HTTP 监听端口")
	webDir := flag.String("web-dir", "./web", "静态资源目录")
	fnosApp := flag.Bool("fnos-app", false, "启用飞牛统一网关模式")
	gatewayPrefix := flag.String("gateway-prefix", defaultGatewayPrefix, "网关路径前缀")
	gatewaySocket := flag.String("gateway-socket", "", "网关 unix socket 路径")
	logmode := flag.String("logmode", "release", "日志模式：release 或 debug")
	deviceTypeFlag := flag.String("device-type", "", "部署形态标识（fnos/docker，仅用于匿名统计的平台分布，环境变量 DEVICE_TYPE）")
	disableStats := flag.Bool("disable-stats", false, "关闭匿名使用统计与支持计数上报")
	showVersion := flag.Bool("version", false, "打印版本信息")
	flag.Parse()

	if *disableStats || os.Getenv("DISABLE_STATS") == "1" {
		os.Setenv("DISABLE_STATS", "1")
	}
	dt := *deviceTypeFlag
	if v := os.Getenv("DEVICE_TYPE"); v != "" {
		dt = v
	}

	if *showVersion {
		fmt.Printf("%s %s (built %s, commit %s)\n", AppName, Version, BuildTime, GitCommit)
		return
	}

	if *logmode == "debug" {
		log.SetFlags(log.LstdFlags | log.Lshortfile)
	} else {
		log.SetFlags(log.LstdFlags)
	}

	// 仅飞牛网关模式下剥离路径前缀；TCP 直连模式保持原始路径
	gwPrefix := ""
	if *fnosApp {
		gwPrefix = *gatewayPrefix
	}
	handler := buildHandler(*webDir, gwPrefix)

	// 匿名使用统计心跳 + 支持作者计数（-disable-stats / DISABLE_STATS=1 关闭）
	statsStart(AppName, Version, dt, *webDir)

	if *fnosApp && *gatewaySocket != "" {
		// 网关 socket：fnOS 统一网关会把 /app/techfunway-brick-game 转发到该 socket
		if err := os.Remove(*gatewaySocket); err != nil && !os.IsNotExist(err) {
			log.Printf("清理旧 socket 失败: %v", err)
		}
		go func() {
			ln, err := net.Listen("unix", *gatewaySocket)
			if err != nil {
				log.Fatalf("网关 socket 监听失败: %v", err)
			}
			if err := os.Chmod(*gatewaySocket, 0o666); err != nil {
				log.Printf("socket 权限设置失败: %v", err)
			}
			log.Printf("网关 socket 就绪: %s (prefix %s)", *gatewaySocket, *gatewayPrefix)
			if err := (&http.Server{Handler: handler}).Serve(ln); err != nil {
				log.Printf("网关 socket 服务退出: %v", err)
			}
		}()
	}

	addr := ":" + *port
	log.Printf("%s %s 启动于 http://localhost:%s (web-dir=%s, logmode=%s)", AppName, Version, *port, *webDir, *logmode)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}

func buildHandler(webDir, gatewayPrefix string) http.Handler {	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		fmt.Fprintf(w, `{"status":"ok","app":%q,"version":%q,"startedAt":%q}`, AppName, Version, startedAt)
	})
	// 支持作者：转发匿名支持计数到统计端点（仅设备信息 + 金额）
	mux.HandleFunc("/api/donate/support", handleDonateSupport)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveStatic(w, r, webDir)
	})
	// 网关模式下剥掉统一网关前缀（包在最外层，覆盖全部路由）
	if gatewayPrefix != "" {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 无斜杠访问（/app/techfunway-brick-game）时必须跳转到带斜杠路径，
			// 否则浏览器以 /app/ 为基准解析相对资源路径，导致页面错乱
			if r.URL.Path == gatewayPrefix {
				http.Redirect(w, r, gatewayPrefix+"/", http.StatusMovedPermanently)
				return
			}
			if strings.HasPrefix(r.URL.Path, gatewayPrefix) {
				r.URL.Path = strings.TrimPrefix(r.URL.Path, gatewayPrefix)
				if r.URL.Path == "" {
					r.URL.Path = "/"
				}
			} else if r.URL.Path != "/api/health" {
				http.NotFound(w, r)
				return
			}
			mux.ServeHTTP(w, r)
		})
	}
	return mux
}

func serveStatic(w http.ResponseWriter, r *http.Request, webDir string) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	name := r.URL.Path
	if name == "/" || name == "" {
		name = "/index.html"
	}
	name = filepath.Clean(name)
	if strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	full := filepath.Join(webDir, name)
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		// 目录请求回退 index.html；其余 404
		if info != nil && info.IsDir() {
			index := filepath.Join(full, "index.html")
			if _, err := os.Stat(index); err == nil {
				full = index
			} else {
				http.NotFound(w, r)
				return
			}
		} else {
			http.NotFound(w, r)
			return
		}
	}
	// html 不缓存（游戏入口），静态资源短缓存
	if strings.HasSuffix(full, ".html") || strings.HasSuffix(full, ".htm") {
		w.Header().Set("Cache-Control", "no-cache")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	}
	ext := strings.TrimPrefix(filepath.Ext(full), ".")
	if mt := mime.TypeByExtension("." + ext); mt != "" {
		w.Header().Set("Content-Type", mt)
	}
	http.ServeFile(w, r, full)
}
