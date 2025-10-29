import * as cron from 'node-cron';
import { BookingsService } from '../bookings/bookings.service';

export function scheduleAutoRelease(bookingsService: BookingsService) {
    cron.schedule('* * * * *', async () => {
        try {
            await bookingsService.releaseUnusedBookings();
        } catch (err) {
            console.error('Auto-release job error', err);
        }
    });
}
