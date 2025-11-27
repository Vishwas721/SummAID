"""Central configuration for LLM model selection and generation options.

This module makes the backend LLM-agnostic: change the model by editing
`.env` (LLM_MODEL_NAME=your_model) and restarting, without touching code.
Falls back to legacy GEN_MODEL if present for backward compatibility.
"""
from __future__ import annotations
import os
from dotenv import load_dotenv

# Load environment (override so runtime changes are respected on restart)
load_dotenv(override=True)

# Primary model name (preferred key)
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME")
# Backward compatibility: fall back to legacy GEN_MODEL or default
if not LLM_MODEL_NAME or not LLM_MODEL_NAME.strip():
    LLM_MODEL_NAME = os.getenv("GEN_MODEL", "llama3:8b").strip()

# Unified generation options (can be extended later)
# NOTE: num_ctx may be trimmed dynamically in fallback logic elsewhere.
GENERATION_OPTIONS = {
    "temperature": float(os.getenv("LLM_TEMPERATURE", 0.1)),
    "top_p": float(os.getenv("LLM_TOP_P", 0.9)),
    "repeat_penalty": float(os.getenv("LLM_REPEAT_PENALTY", 1.1)),
    # num_ctx is context length; override via env if needed
    "num_ctx": int(os.getenv("LLM_NUM_CTX", 8192)),
}

# Fallback models list (ordered)
# These can be overridden by setting LLM_FALLBACK_MODELS as comma-separated names.
_default_fallbacks = [
    "qwen2.5:7b-instruct-q4_K_M",
    "qwen2.5:3b-instruct-q4_K_M",
    "llama3.2:3b-instruct-q4_K_M"
]
_fb_env = os.getenv("LLM_FALLBACK_MODELS")
if _fb_env:
    FALLBACK_MODELS = [m.strip() for m in _fb_env.split(",") if m.strip()]
else:
    FALLBACK_MODELS = _default_fallbacks

__all__ = [
    "LLM_MODEL_NAME",
    "GENERATION_OPTIONS",
    "FALLBACK_MODELS"
]
