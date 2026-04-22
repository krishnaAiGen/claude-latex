import asyncio
import os
import re
import shutil
from dataclasses import dataclass, field

from app.config import settings


@dataclass
class CompilationError:
    line: int | None
    message: str
    file: str | None = None


@dataclass
class CompilationResult:
    success: bool
    pdf_path: str | None = None
    log: str = ""
    errors: list[CompilationError] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def parse_latex_log(log: str) -> tuple[list[CompilationError], list[str]]:
    errors: list[CompilationError] = []
    warnings: list[str] = []

    for line in log.split("\n"):
        error_match = re.match(r"^!\s+(.+)", line)
        if error_match:
            errors.append(CompilationError(line=None, message=error_match.group(1)))
            continue

        line_error = re.match(r"^(.+):(\d+):\s+(.+)", line)
        if line_error:
            errors.append(
                CompilationError(
                    file=line_error.group(1),
                    line=int(line_error.group(2)),
                    message=line_error.group(3),
                )
            )
            continue

        if "Warning:" in line:
            warnings.append(line.strip())

    return errors, warnings


def get_cache_dir(user_id: str, project_id: str) -> str:
    cache = os.path.join(str(settings.storage_dir), "cache", user_id, project_id)
    os.makedirs(cache, exist_ok=True)
    return cache


async def _run_pdflatex(work_dir: str) -> tuple[int, str]:
    """Run pdflatex directly as local subprocess."""
    abs_dir = os.path.abspath(work_dir)
    pdflatex_bin = shutil.which("pdflatex") or "/usr/bin/pdflatex"
    proc = await asyncio.create_subprocess_exec(
        pdflatex_bin,
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-synctex=1",
        "-output-directory", abs_dir,
        os.path.join(abs_dir, "main.tex"),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=abs_dir,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=settings.compile_timeout_seconds,
        )
    except asyncio.TimeoutError:
        proc.kill()
        return -1, "Compilation timed out"

    output = stdout.decode("utf-8", errors="replace")
    err = stderr.decode("utf-8", errors="replace")
    return proc.returncode or 0, output + err


async def compile_latex(user_id: str, project_id: str, latex_content: str | None = None) -> CompilationResult:
    cache_dir = get_cache_dir(user_id, project_id)

    try:
        # Write content to local cache only (S3 sync happens elsewhere)
        if latex_content is not None:
            with open(os.path.join(cache_dir, "main.tex"), "w", encoding="utf-8") as f:
                f.write(latex_content)

        tex_path = os.path.join(cache_dir, "main.tex")
        pdf_path = os.path.join(cache_dir, "main.pdf")

        if not os.path.exists(tex_path):
            return CompilationResult(
                success=False,
                errors=[CompilationError(line=None, message="main.tex not found in project")],
            )

        # First pass
        returncode, log_text = await _run_pdflatex(cache_dir)

        if returncode == -1:
            return CompilationResult(
                success=False,
                log="Compilation timed out",
                errors=[CompilationError(
                    line=None,
                    message=f"Compilation timed out after {settings.compile_timeout_seconds}s",
                )],
            )

        # Second pass only if needed
        if "Rerun" in log_text or "rerun" in log_text:
            returncode, log_text = await _run_pdflatex(cache_dir)

        errors, warnings = parse_latex_log(log_text)

        if os.path.exists(pdf_path) and returncode == 0:
            return CompilationResult(
                success=True,
                pdf_path=pdf_path,
                log=log_text,
                errors=errors,
                warnings=warnings,
            )
        else:
            return CompilationResult(
                success=False,
                log=log_text,
                errors=errors or [CompilationError(line=None, message="Compilation failed")],
                warnings=warnings,
            )

    except FileNotFoundError:
        return CompilationResult(
            success=False,
            log="pdflatex not found",
            errors=[CompilationError(
                line=None,
                message="pdflatex is not installed on the server.",
            )],
        )
    except Exception as e:
        return CompilationResult(
            success=False,
            log=str(e),
            errors=[CompilationError(line=None, message=str(e))],
        )


def clear_cache(user_id: str, project_id: str) -> None:
    cache = os.path.join(str(settings.storage_dir), "cache", user_id, project_id)
    if os.path.exists(cache):
        shutil.rmtree(cache, ignore_errors=True)
