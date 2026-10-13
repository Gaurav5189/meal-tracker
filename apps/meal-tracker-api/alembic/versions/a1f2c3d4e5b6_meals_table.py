"""meals table

Revision ID: a1f2c3d4e5b6
Revises: 39b4e9a26312
Create Date: 2026-10-13 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1f2c3d4e5b6"
down_revision: str | Sequence[str] | None = "39b4e9a26312"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "meals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("meal_date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.Text(), nullable=False),
        sa.Column("taken", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("taken_manual", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("price_overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "meal_date", "meal_type", name="uq_meals_user_date_type"),
        sa.CheckConstraint("meal_type IN ('lunch', 'dinner')", name="ck_meals_type"),
    )
    op.create_index("ix_meals_user_date", "meals", ["user_id", "meal_date"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_meals_user_date", table_name="meals")
    op.drop_table("meals")
