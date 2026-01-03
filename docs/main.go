package main

import (
	"flag"
	"log"
	"os"
	"reflect"

	s3 "github.com/panyam/s3gen"
)

var (
	addr  = flag.String("addr", DefaultAddress(), "Address where the http server is running")
	build = flag.Bool("build", false, "Builds the latest site and quits instead of running a server to serve it")
)

// Site configuration for Galore Documentation
var Site = &s3.Site{
	// Output directory for generated static site
	OutputDir: "./dist/docs",

	// Source content directory
	ContentRoot: "./content",

	// URL path prefix (e.g., if hosting at panyam.github.io/galore/)
	PathPrefix: "/galore",

	// Template directories (searched in order)
	TemplateFolders: []string{
		"./templates",
	},

	// Static asset directories (copied to output)
	// Format: URL path, local folder (pairs)
	StaticFolders: []string{
		"/static/", "./static",
	},

	// Default base template for all pages
	DefaultBaseTemplate: s3.BaseTemplate{
		Name: "BasePage.html",
		Params: map[any]any{
			"BodyTemplateName": "Content",
		},
	},
}

func main() {
	flag.Parse()
	log.Println("Build: ", *build, reflect.TypeOf(*build))

	// In development mode, enable live reloading
	if *build || os.Getenv("GALORE_DOCS_ENV") != "production" {
		Site.Rebuild(nil)
		Site.Watch()
	}

	if !*build {
		Site.Serve(*addr)
	}
}

func DefaultAddress() string {
	addr := os.Getenv("GALORE_DOCS_PORT")
	if addr != "" {
		return addr
	}
	return ":8085"
}
