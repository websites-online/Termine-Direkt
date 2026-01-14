import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type HeroMonitorMode = 'reservation-preview' | 'dashboard-preview' | 'custom';

@Component({
  selector: 'app-hero-monitor-mockup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-monitor-mockup.component.html',
  styleUrl: './hero-monitor-mockup.component.css'
})
export class HeroMonitorMockupComponent {
  @Input() mode: HeroMonitorMode = 'reservation-preview';
  @Input() title = 'Demo Unternehmen';
}
