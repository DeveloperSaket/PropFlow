#!/bin/sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_user POSTGRES_APP_USER
\getenv app_database POSTGRES_DB
\getenv app_password POSTGRES_APP_PASSWORD
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password') \gexec
GRANT CONNECT ON DATABASE :"app_database" TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
SQL
