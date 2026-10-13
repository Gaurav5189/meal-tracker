"""users and settings tables

Revision ID: 39b4e9a26312
Revises: 
Create Date: 2026-10-13 16:24:40.018446

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39b4e9a26312'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('username', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('tz', sa.Text(), nullable=False),
    sa.Column('materialized_through', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_table('settings',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('currency', sa.CHAR(length=3), nullable=False),
    sa.Column('lunch_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('dinner_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('dinner_same_as_lunch', sa.Boolean(), nullable=False),
    sa.Column('upcoming_default_on', sa.Boolean(), nullable=False),
    sa.Column('lock_past_meals', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('settings')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_table('users')
