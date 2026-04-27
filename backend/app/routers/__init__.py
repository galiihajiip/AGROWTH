"""Re-export semua router AGROWTH."""
from app.routers import mangsa, predict, recommendation, vulnerability

__all__ = ["mangsa", "predict", "recommendation", "vulnerability"]
