import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config"
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Provides the Prisma client as a Nest-managed service: one database
connection for the whole application, opened on start, closed on shutdown. */
@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {
    constructor(config: ConfigService) {
        const adapter = new PrismaPg({
            connectionString: config.getOrThrow<string>('DATABASE_URL')
        });
        super({ adapter });
    }
    async onModuleInit() { await this.$connect() }
    async onModuleDestroy() { await this.$disconnect() }
}