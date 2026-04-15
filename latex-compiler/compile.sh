#!/bin/bash
set -e

cd /workdir

# Run pdflatex twice for cross-references
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
