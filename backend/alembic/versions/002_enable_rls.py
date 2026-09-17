"""Enable RLS and add policies for application tables.

The application uses its own integer-ID JWTs, not Supabase Auth UUIDs. The
backend sets transaction-local ``app.user_id`` after validating that JWT.
Supabase Data API requests do not have that setting and therefore match no
policy, which keeps direct table access closed until an explicit identity
mapping is implemented.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_enable_rls"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    op.add_column("conversations", sa.Column("created_by", sa.Integer(), nullable=True))
    op.create_index("ix_conversations_created_by", "conversations", ["created_by"])
    if bind.dialect.name != "postgresql":
        return

    op.create_foreign_key(
        "fk_conversations_created_by_users",
        "conversations",
        "users",
        ["created_by"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.execute("""
        CREATE SCHEMA IF NOT EXISTS private;
        REVOKE ALL ON SCHEMA private FROM PUBLIC;
        CREATE OR REPLACE FUNCTION private.app_current_user_id()
        RETURNS integer
        LANGUAGE sql
        STABLE
        SET search_path = pg_catalog
        AS $$
            SELECT CASE
                WHEN current_setting('app.user_id', true) ~ '^[0-9]+$'
                THEN current_setting('app.user_id', true)::integer
                ELSE NULL
            END
        $$;
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION private.is_conversation_member(target_conversation_id integer, target_user_id integer)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public, pg_catalog
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM public.conversation_members
                WHERE conversation_id = target_conversation_id AND user_id = target_user_id
            )
        $$;
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION private.is_conversation_admin(target_conversation_id integer, target_user_id integer)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public, pg_catalog
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM public.conversation_members
                WHERE conversation_id = target_conversation_id
                  AND user_id = target_user_id
                  AND role = 'admin'
            )
        $$;
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION private.is_conversation_creator(target_conversation_id integer, target_user_id integer)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public, pg_catalog
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM public.conversations
                WHERE id = target_conversation_id AND created_by = target_user_id
            )
        $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                GRANT USAGE ON SCHEMA private TO anon;
                GRANT EXECUTE ON FUNCTION private.app_current_user_id() TO anon;
                GRANT EXECUTE ON FUNCTION private.is_conversation_member(integer, integer) TO anon;
                GRANT EXECUTE ON FUNCTION private.is_conversation_admin(integer, integer) TO anon;
                GRANT EXECUTE ON FUNCTION private.is_conversation_creator(integer, integer) TO anon;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                GRANT USAGE ON SCHEMA private TO authenticated;
                GRANT EXECUTE ON FUNCTION private.app_current_user_id() TO authenticated;
                GRANT EXECUTE ON FUNCTION private.is_conversation_member(integer, integer) TO authenticated;
                GRANT EXECUTE ON FUNCTION private.is_conversation_admin(integer, integer) TO authenticated;
                GRANT EXECUTE ON FUNCTION private.is_conversation_creator(integer, integer) TO authenticated;
            END IF;
        END
        $$;
    """)

    for table in ("users", "conversations", "conversation_members", "messages"):
        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))

    op.execute("""
        CREATE POLICY users_select_self ON users FOR SELECT
        USING (id = private.app_current_user_id())
    """)
    op.execute("""
        CREATE POLICY users_insert_self ON users FOR INSERT
        WITH CHECK (id = private.app_current_user_id())
    """)
    op.execute("""
        CREATE POLICY users_update_self ON users FOR UPDATE
        USING (id = private.app_current_user_id())
        WITH CHECK (id = private.app_current_user_id())
    """)
    op.execute("""
        CREATE POLICY users_delete_self ON users FOR DELETE
        USING (id = private.app_current_user_id())
    """)

    op.execute("""
        CREATE POLICY conversations_select_member ON conversations FOR SELECT
        USING (private.is_conversation_member(id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY conversations_insert_creator ON conversations FOR INSERT
        WITH CHECK (created_by = private.app_current_user_id())
    """)
    op.execute("""
        CREATE POLICY conversations_update_admin ON conversations FOR UPDATE
        USING (private.is_conversation_admin(id, private.app_current_user_id()))
        WITH CHECK (private.is_conversation_admin(id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY conversations_delete_creator ON conversations FOR DELETE
        USING (created_by = private.app_current_user_id())
    """)

    op.execute("""
        CREATE POLICY members_select_participant ON conversation_members FOR SELECT
        USING (user_id = private.app_current_user_id()
            OR private.is_conversation_member(conversation_id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY members_insert_admin ON conversation_members FOR INSERT
        WITH CHECK (private.is_conversation_admin(conversation_id, private.app_current_user_id())
            OR (user_id = private.app_current_user_id()
                AND private.is_conversation_creator(conversation_id, private.app_current_user_id())))
    """)
    op.execute("""
        CREATE POLICY members_update_admin ON conversation_members FOR UPDATE
        USING (private.is_conversation_admin(conversation_id, private.app_current_user_id()))
        WITH CHECK (private.is_conversation_admin(conversation_id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY members_delete_admin_or_self ON conversation_members FOR DELETE
        USING (user_id = private.app_current_user_id()
            OR private.is_conversation_admin(conversation_id, private.app_current_user_id()))
    """)

    op.execute("""
        CREATE POLICY messages_select_participant ON messages FOR SELECT
        USING (private.is_conversation_member(conversation_id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY messages_insert_sender ON messages FOR INSERT
        WITH CHECK (sender_id = private.app_current_user_id()
            AND private.is_conversation_member(conversation_id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY messages_update_sender ON messages FOR UPDATE
        USING (sender_id = private.app_current_user_id())
        WITH CHECK (sender_id = private.app_current_user_id()
            AND private.is_conversation_member(conversation_id, private.app_current_user_id()))
    """)
    op.execute("""
        CREATE POLICY messages_delete_sender ON messages FOR DELETE
        USING (sender_id = private.app_current_user_id())
    """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        policies = (
            ("users", ("users_select_self", "users_insert_self", "users_update_self", "users_delete_self")),
            ("conversations", ("conversations_select_member", "conversations_insert_creator", "conversations_update_admin", "conversations_delete_creator")),
            ("conversation_members", ("members_select_participant", "members_insert_admin", "members_update_admin", "members_delete_admin_or_self")),
            ("messages", ("messages_select_participant", "messages_insert_sender", "messages_update_sender", "messages_delete_sender")),
        )
        for table, table_policies in policies:
            for policy in table_policies:
                op.execute(sa.text(f"DROP POLICY IF EXISTS {policy} ON {table}"))
            op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
        op.execute("DROP FUNCTION IF EXISTS private.is_conversation_creator(integer, integer)")
        op.execute("DROP FUNCTION IF EXISTS private.is_conversation_admin(integer, integer)")
        op.execute("DROP FUNCTION IF EXISTS private.is_conversation_member(integer, integer)")
        op.execute("DROP FUNCTION IF EXISTS private.app_current_user_id()")
        op.execute("DROP SCHEMA IF EXISTS private")
        op.drop_constraint("fk_conversations_created_by_users", "conversations", type_="foreignkey")

    op.drop_index("ix_conversations_created_by", table_name="conversations")
    op.drop_column("conversations", "created_by")