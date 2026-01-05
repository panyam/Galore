
NUM_LINKED_GOMODS=`cat go.mod | grep -v "^\/\/" | grep replace | wc -l | sed -e "s/ *//g"`

all: build run

run:
	GALORE_DOCS_ENV=dev GALORE_DOCS_PORT=:8085 go run .

webpack:
	pnpm build

checklinks:
	@if [ x"${NUM_LINKED_GOMODS}" != "x0" ]; then	\
		echo "You are trying to deploy with symlinks. Remove them first and make sure versions exist" && false ;	\
	fi

build: resymlink copycss webpack

copycss:
	cp node_modules/@panyam/tsappkit/dist/docs/DocsPage.css static/css/tsappkit-docs.css

resymlink:
	mkdir -p locallinks
	rm -Rf locallinks/*
	cd locallinks && ln -s ../../../../golang/templar
	cd locallinks && ln -s ../../../../golang/goutils
	cd locallinks && ln -s ../../../../golang/s3gen

# GitHub Pages deployment
gh-pages: build
	@echo "Building production site..."
	@GALORE_DOCS_ENV=production go run main.go -build
	rm -Rf dist/docs/static
	cp -r static dist/docs
	@echo "Deploying to gh-pages branch..."
	@if [ -d dist/docs/.git ]; then \
		echo "Error: dist/docs appears to be a git repo. Please remove it first."; \
		exit 1; \
	fi
	@cd dist/docs && \
		touch .nojekyll && \
		git init && \
		git add -A && \
		git commit -m "Deploy to GitHub Pages" && \
		git branch -M gh-pages && \
		git remote add origin git@panyam-github:panyam/Galore.git && \
		git push -f origin gh-pages
	@echo "Deployed! Enable GitHub Pages in repo settings to serve from gh-pages branch"
	@rm -rf dist/docs/.git

clean:
	rm -rf dist/docs
	rm -rf static/js/gen/*

.PHONY: all run webpack build resymlink gh-pages clean checklinks
