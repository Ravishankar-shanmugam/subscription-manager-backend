import type { APIGatewayProxyResult } from 'aws-lambda';
import { dashboardService, reportService, reminderService } from '../services/subscriptionService';
import { ok, handleError } from '../utils/response';

export async function getDashboard(): Promise<APIGatewayProxyResult> {
  try {
    const stats = await dashboardService.getStats();
    return ok(stats);
  } catch (err) {
    return handleError(err);
  }
}

export async function getReports(): Promise<APIGatewayProxyResult> {
  try {
    const reports = await reportService.getReports();
    return ok(reports);
  } catch (err) {
    return handleError(err);
  }
}

export async function getReminders(): Promise<APIGatewayProxyResult> {
  try {
    const reminders = await reminderService.getDueReminders();
    return ok(reminders);
  } catch (err) {
    return handleError(err);
  }
}
