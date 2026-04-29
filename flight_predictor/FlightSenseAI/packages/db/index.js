// Shared database package
// Re-exports Prisma client for use across apps

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = { prisma };
