"""Shared LLM setup for review agents."""
from langchain_openai import ChatOpenAI
from app.config import settings


def get_llm(model: str | None = None, max_tokens: int = 4096) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or settings.review_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        max_tokens=max_tokens,
    )
