import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-booking-referral',
  standalone: true,
  templateUrl: './booking-referral.component.html',
  styleUrl: './booking-referral.component.css',
})
export class BookingReferralComponent {
  @Input({ required: true }) companyName = '';
}
