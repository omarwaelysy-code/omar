---
name: erp-architecture
description: Project-specific architecture rules for the ERP system. Protects modules, database structure, business logic, and UI consistency.
---

# ERP Architecture Skill

## Project Identity

This project is a production ERP and Cafe Management System.

The application contains:

- Sales
- Invoices
- Customers
- Products
- Inventory
- Operations
- Reports
- Users and Permissions
- Accounting features
- POS functionality

The system is running in a production environment.

---

# Golden ERP Rules

## 1. Never Break Existing Features

Before modifying any module:

1. Understand the current implementation.
2. Check related frontend components.
3. Check backend APIs.
4. Check database relationships.
5. Check existing business logic.

Do not rewrite working modules unnecessarily.

Always prefer minimal safe changes.

---

# Database Architecture

Database changes MUST follow the migration system.

Never:

- Modify production tables manually.
- Delete existing columns without approval.
- Change existing IDs.
- Rename tables without migration.
- Remove existing relationships.

Prefer:

- New migrations.
- Backward-compatible changes.
- Nullable fields when appropriate.
- Safe foreign key relationships.

---

# ERP Modules Rules

## Customers

Customer data is critical.

Do not remove:

- Customer history
- Previous invoices
- Transactions
- Payments

---

## Products

Products are connected to:

- Inventory
- Sales
- Purchases
- Reports

Any product change must consider all related modules.

---

## Invoices

Invoices are financial records.

Never:

- Change invoice totals silently.
- Delete invoice history.
- Modify completed invoices without audit tracking.

Invoices must preserve:

- Date
- Customer
- Items
- Quantities
- Prices
- Total
- User who created it

---

## Inventory

Inventory changes must maintain consistency.

Before changing inventory logic:

Check:

- Stock movements
- Purchases
- Sales
- Adjustments
- Reports

Never update inventory without recording the correct movement.

---

# Operations Module

Operations depend on:

- Categories
- Fields
- Departments
- Dynamic forms

Rules:

- Do not remove existing operation fields.
- Preserve category inheritance logic.
- Parent categories must continue working.
- General fields must remain available.
- Relations must remain safe.

---

# Permissions System

The system contains roles:

- Super Admin
- Admin
- Users

Never bypass permissions.

Every sensitive action must respect:

- User role
- Company access
- Authorization rules

---

# Frontend Rules

The UI must maintain:

- Arabic RTL support.
- Responsive design.
- Existing design system.
- Consistent components.

Do not introduce a new UI framework without approval.

Do not change layouts unrelated to the requested feature.

---

# API Rules

Before modifying an API:

Check:

- Existing consumers.
- Frontend usage.
- Request format.
- Response format.
- Error handling.

Avoid breaking existing API contracts.

Prefer adding new fields instead of removing old ones.

---

# Testing After Changes

After modifying ERP features verify:

## Frontend

- Page loads correctly.
- Forms submit correctly.
- Data displays correctly.

## Backend

- API returns correct responses.
- Validation works.
- Errors are handled.

## Database

- Data is saved correctly.
- Relationships work.
- Existing records remain accessible.

---

# Debugging ERP Problems

When a problem appears:

Follow this order:

1. Check frontend data.
2. Check API request.
3. Check backend processing.
4. Check database query.
5. Check logs.

Do not assume the problem is in the database.

---

# Deployment

Before Production deployment:

1. Build successfully.
2. Verify migrations.
3. Backup if required.
4. Deploy safely.
5. Restart service.
6. Check health.

---

# Change Report

After every major change report:

## Changed
Files and features modified.

## Database
Any migration created.

## Risk
Possible affected modules.

## Verification
Tests performed.

## Status
Success or Failed.