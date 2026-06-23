from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncOpenAI


ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com"


@dataclass(frozen=True)
class LLMTextResponse:
    content: str
    finish_reason: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None


def normalize_api_format(api_format: Optional[str]) -> str:
    normalized = str(api_format or "openai").strip().lower()
    if normalized in {"anthropic", "anthropic_messages", "claude"}:
        return "anthropic"
    return "openai"


async def complete_text(
    config: Any,
    messages: List[Dict[str, Any]],
    *,
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> LLMTextResponse:
    return await complete_text_with_config(
        api_format=getattr(config, "api_format", "openai"),
        base_url=getattr(config, "base_url", ""),
        api_key=getattr(config, "api_key", ""),
        model_name=getattr(config, "model_name", ""),
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )


async def complete_text_with_config(
    *,
    api_format: Optional[str],
    base_url: str,
    api_key: str,
    model_name: str,
    messages: List[Dict[str, Any]],
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> LLMTextResponse:
    if normalize_api_format(api_format) == "anthropic":
        return await _complete_anthropic_messages(
            base_url=base_url,
            api_key=api_key,
            model_name=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    return await _complete_openai_chat(
        base_url=base_url,
        api_key=api_key,
        model_name=model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )


async def _complete_openai_chat(
    *,
    base_url: str,
    api_key: str,
    model_name: str,
    messages: List[Dict[str, Any]],
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> LLMTextResponse:
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout,
    )

    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )

    choice = response.choices[0]
    return LLMTextResponse(
        content=choice.message.content or "",
        finish_reason=getattr(choice, "finish_reason", None),
    )


async def _complete_anthropic_messages(
    *,
    base_url: str,
    api_key: str,
    model_name: str,
    messages: List[Dict[str, Any]],
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> LLMTextResponse:
    system_parts: List[str] = []
    anthropic_messages: List[Dict[str, Any]] = []
    for message in messages:
        role = str(message.get("role") or "user")
        content = _message_content_to_text(message.get("content"))
        if role == "system":
            if content:
                system_parts.append(content)
            continue
        if role not in {"user", "assistant"}:
            role = "user"
        anthropic_messages.append({"role": role, "content": content})

    if not anthropic_messages:
        anthropic_messages.append({"role": "user", "content": ""})

    payload: Dict[str, Any] = {
        "model": model_name,
        "max_tokens": max_tokens,
        "messages": anthropic_messages,
        "temperature": temperature,
    }
    if system_parts:
        payload["system"] = "\n\n".join(system_parts)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            _anthropic_messages_url(base_url),
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Anthropic API error {response.status_code}: {response.text[:500]}"
        )

    data = response.json()
    return LLMTextResponse(
        content=_extract_anthropic_text(data),
        finish_reason=data.get("stop_reason"),
        raw=data,
    )


def _anthropic_messages_url(base_url: str) -> str:
    normalized = str(base_url or DEFAULT_ANTHROPIC_BASE_URL).strip().rstrip("/")
    if normalized.endswith("/messages"):
        return normalized
    if normalized.endswith("/v1"):
        return f"{normalized}/messages"
    return f"{normalized}/v1/messages"


def _message_content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text" and item.get("text") is not None:
                    parts.append(str(item.get("text")))
                elif item.get("content") is not None:
                    parts.append(str(item.get("content")))
            elif item is not None:
                parts.append(str(item))
        return "\n".join(parts)
    return "" if content is None else str(content)


def _extract_anthropic_text(data: Dict[str, Any]) -> str:
    parts = []
    for block in data.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(str(block.get("text") or ""))
    return "".join(parts)
