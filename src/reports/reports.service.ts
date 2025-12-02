import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    // Validasi user yang dilaporkan ada
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: dto.reportedUserId },
    });

    if (!reportedUser) {
      throw new NotFoundException('Pengguna yang dilaporkan tidak ditemukan');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId: dto.reportedUserId,
        reason: dto.reason,
        description: dto.description,
        evidence: dto.evidence,
      },
    });

    // Notifikasi ke Admin (Opsional, cari semua admin)
    // const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    // ... logic kirim notif ke admin

    return report;
  }

  // Untuk Admin: List Reports
  async findAll() {
    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, fullName: true, email: true } },
        reportedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: 'RESOLVED' | 'DISMISSED',
    notes?: string,
  ) {
    return this.prisma.report.update({
      where: { id },
      data: {
        status,
        adminNotes: notes,
        resolvedAt: new Date(),
      },
    });
  }
}
