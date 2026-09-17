from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def set_current_user(db, user_id: int) -> None:
    """Set the transaction-local identity used by PostgreSQL RLS policies."""
    if db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT set_config('app.user_id', :user_id, true)"),
            {"user_id": str(user_id)},
        )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
