// Separate status types for users vs folder/document items.
// String unions are preferred over TS enums: zero runtime cost, no reverse-
// mapping footguns, and Prisma's own generated types use the same pattern.

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type ItemStatus = "ACTIVE" | "DELETED";

export type Role = "ADMIN" | "USER";
