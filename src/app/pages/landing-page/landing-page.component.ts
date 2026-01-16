import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';
import { HeroMonitorMode } from '../../components/hero-monitor-mockup/hero-monitor-mockup.component';

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
    ContactFormComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {
  screenMode: HeroMonitorMode = 'reservation-preview';
  isNavOpen = false;
  @ViewChild('cursorBall') cursorBall?: ElementRef<HTMLElement>;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private rafId?: number;

  setScreenMode(mode: HeroMonitorMode): void {
    this.screenMode = mode;
  }

  toggleNav(): void {
    this.isNavOpen = !this.isNavOpen;
  }

  closeNav(): void {
    this.isNavOpen = false;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.targetX = event.clientX;
    this.targetY = event.clientY;
    this.startBallFollow();
  }

  private startBallFollow(): void {
    const ball = this.cursorBall?.nativeElement;
    if (!ball || this.rafId) {
      return;
    }

    const animate = () => {
      const dx = this.targetX - this.currentX;
      const dy = this.targetY - this.currentY;
      this.currentX += dx * 0.12;
      this.currentY += dy * 0.12;
      ball.style.left = `${this.currentX}px`;
      ball.style.top = `${this.currentY}px`;
      ball.style.opacity = '0.7';
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        this.rafId = undefined;
        return;
      }
      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }
}
