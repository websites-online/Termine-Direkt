import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CountUpDirective } from '../../shared/count-up.directive';

/** „Lohnt sich NexTime?“ – Rechner für die Startseite. Alle Werte sind Annahmen des Besuchers. */
@Component({
  selector: 'app-roi-calculator',
  standalone: true,
  imports: [FormsModule, CountUpDirective],
  templateUrl: './roi-calculator.component.html',
  styleUrl: './roi-calculator.component.css',
})
export class RoiCalculatorComponent {
  /** Kalkuliert wird immer mit dem Starter-Tarif. */
  readonly price = 19.99;

  extra = 15;
  ticket = 35;

  get revenue(): number {
    return this.extra * this.ticket;
  }

  get net(): number {
    return this.revenue - this.price;
  }

  get roi(): number {
    return Math.round((this.revenue / this.price) * 10) / 10;
  }

  get breakEven(): number {
    return Math.max(1, Math.ceil(this.price / this.ticket));
  }

  get paysOff(): boolean {
    return this.net > 0;
  }

  fill(value: number, min: number, max: number): string {
    return `${((value - min) / (max - min)) * 100}%`;
  }

  euro(value: number, digits = 0): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }
}
