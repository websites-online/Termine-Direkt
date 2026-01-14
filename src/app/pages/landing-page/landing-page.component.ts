import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';
import { HeroMonitorMockupComponent, HeroMonitorMode } from '../../components/hero-monitor-mockup/hero-monitor-mockup.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BenefitsComponent,
    HowItWorksComponent,
    PricingComponent,
    FaqComponent,
    FooterComponent,
    ContactFormComponent,
    HeroMonitorMockupComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {
  screenMode: HeroMonitorMode = 'reservation-preview';
  isNavOpen = false;

  setScreenMode(mode: HeroMonitorMode): void {
    this.screenMode = mode;
  }

  toggleNav(): void {
    this.isNavOpen = !this.isNavOpen;
  }

  closeNav(): void {
    this.isNavOpen = false;
  }
}
