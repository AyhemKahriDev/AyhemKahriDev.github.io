package main

import(
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// Fingerprinted build output under /assets/ can be cached forever, everything else has to revalidate.
func cacheControl(requestPath string) string{
	if strings.HasPrefix(requestPath, "/assets/"){
		return "public, max-age=31536000, immutable"
	}
	switch strings.ToLower(filepath.Ext(requestPath)){
	case ".html", ".css", ".js", ".ts", ".map":
		return "no-cache, no-store, must-revalidate"
	default:
		return "no-cache"
	}
}

func main(){
	app:=fiber.New(fiber.Config{
		AppName: "HackathonGame",
	})
	app.Use(logger.New())
	app.Use(recover.New())
	distPath, err:=filepath.Abs("./dist")
	if err!=nil{
		log.Fatalf("Failed to resolve dist path: %v", err)
	}
	if _, err:=os.Stat(distPath); os.IsNotExist(err){
		log.Fatalf("Dist folder not found at %s. Did you run 'npm run build'?", distPath)
	}
	app.Use("/", func(c *fiber.Ctx) error{
		requestPath:=c.Path()
		fullPath:=filepath.Join(distPath, requestPath)
		if info, err:=os.Stat(fullPath); err==nil&&!info.IsDir(){
			c.Set("Cache-Control", cacheControl(requestPath))
			return c.SendFile(fullPath)
		}
		return c.Next()
	})
	app.Use("*", func(c *fiber.Ctx) error{
		if strings.HasPrefix(c.Path(), "/api"){
			return c.Next()
		}
		if c.Path()=="/"||c.Path()=="/index.html"{
			c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
			return c.SendFile(filepath.Join(distPath, "index.html"))
		}
		// Assets are referenced relatively, so unknown paths redirect instead of serving a copy
		// of the page that would resolve its assets against the wrong folder.
		return c.Redirect("/", fiber.StatusFound)
	})
	port:=os.Getenv("PORT")
	if port==""{
		port="6008"
	}
	log.Printf("Server starting on http://localhost:%s", port)
	log.Fatal(app.Listen(":"+port))
}
