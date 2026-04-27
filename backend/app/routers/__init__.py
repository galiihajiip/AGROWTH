"""Re-export semua router AGROWTH."""
from app.routers import info, mangsa, predict, recommendation, vulnerability

__all__ = ["info", "mangsa", "predict", "recommendation", "vulnerability"]
