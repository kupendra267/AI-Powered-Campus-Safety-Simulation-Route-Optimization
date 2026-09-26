from datetime import datetime, timezone
from backend.extensions import db, bcrypt

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='STUDENT')  # 'ADMIN' or 'STUDENT'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, raw_password: str):
        """Hash password using Bcrypt with salt (and Werkzeug fallback)."""
        try:
            self.password_hash = bcrypt.generate_password_hash(raw_password).decode('utf-8')
        except Exception:
            from werkzeug.security import generate_password_hash
            self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Verify password against stored hash."""
        if not self.password_hash:
            return False
        try:
            if self.password_hash.startswith('$2b$') or self.password_hash.startswith('$2a$'):
                return bcrypt.check_password_hash(self.password_hash, raw_password)
            from werkzeug.security import check_password_hash
            return check_password_hash(self.password_hash, raw_password)
        except Exception:
            from werkzeug.security import check_password_hash
            try:
                return check_password_hash(self.password_hash, raw_password)
            except Exception:
                return False

    def to_dict(self):
        """Serialize user object without sensitive information."""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
