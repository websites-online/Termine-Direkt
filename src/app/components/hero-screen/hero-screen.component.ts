import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type HeroScreenMode = 'reservation-preview' | 'dashboard-preview' | 'custom';

@Component({
  selector: 'app-hero-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-screen.component.html',
  styleUrl: './hero-screen.component.css'
})
export class HeroScreenComponent {
  @Input() mode: HeroScreenMode = 'reservation-preview';
  @Input() title = 'Vorschau';
}
