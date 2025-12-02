import { z } from 'zod';

export const CreateReportSchema = z.object({
  reportedUserId: z.string().cuid({ message: 'ID User tidak valid' }),
  reason: z.string().min(3, 'Pilih alasan pelaporan'),
  description: z.string().min(10, 'Deskripsi minimal 10 karakter'),
  evidence: z.array(z.string().url()).optional().default([]),
});

export type CreateReportDto = z.infer<typeof CreateReportSchema>;
