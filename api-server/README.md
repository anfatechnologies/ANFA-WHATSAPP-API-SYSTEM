# api-server (Abandoned Scaffold — Not In Use)

> **Status:** Abandoned / Not Implemented  
> **Decision Required:** Delete this directory or promote it to an active microservice.

## What is this?

This directory contains an auto-generated Node.js/Express/Prisma scaffold with dependencies declared in `package.json` (express, prisma, bcryptjs, jsonwebtoken) but **zero source code** — no `src/`, no `index.ts`, no `schema.prisma`.

It is **not referenced in `docker-compose.yml`** and is therefore not built or run as part of the system.

## Why does it exist?

It appears to be a leftover from an early prototyping phase where a Node.js backend was considered as an alternative to the current **Python/FastAPI backend** (`./backend/`).

## Active Backend

The **real, production backend** is in `./backend/` (Python + FastAPI + SQLAlchemy + ARQ). That is the only backend you should be working in.

## What to do

- **Option A (Recommended):** Delete this `api-server/` directory entirely to eliminate confusion. Run: `git rm -r api-server/`
- **Option B:** If there is a plan to use this as a dedicated auth microservice or similar, add a `src/index.ts` and a `schema.prisma` and reference it in `docker-compose.yml`. Update this README with the service purpose and owner.

Until Option B is actively pursued, Option A is strongly recommended.
