FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Install dependencies (source is mounted as a volume at runtime)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

EXPOSE 8000

CMD ["uv", "run", "daphne", "-b", "0.0.0.0", "-p", "8000", "conf.asgi:application"]
