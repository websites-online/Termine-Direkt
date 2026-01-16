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
  isNavCompact = false;
  @ViewChild('cursorArrow') cursorArrow?: ElementRef<HTMLElement>;
  @ViewChild('demoBtn') demoBtn?: ElementRef<HTMLElement>;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private targetAngle = 0;
  private currentAngle = 0;
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

  @HostListener('window:scroll')
  onScroll(): void {
    this.isNavCompact = window.scrollY > 24;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.targetX = event.clientX;
    this.targetY = event.clientY;
    this.updateTargetAngle(event.clientX, event.clientY);
    this.startBallFollow();
  }

  private startBallFollow(): void {
    const arrow = this.cursorArrow?.nativeElement;
    if (!arrow || this.rafId) {
      return;
    }

    const animate = () => {
      const dx = this.targetX - this.currentX;
      const dy = this.targetY - this.currentY;
      this.currentX += dx * 0.12;
      this.currentY += dy * 0.12;
      this.currentAngle += (this.targetAngle - this.currentAngle) * 0.18;
      arrow.style.left = `${this.currentX}px`;
      arrow.style.top = `${this.currentY}px`;
      arrow.style.opacity = '0.8';
      arrow.style.transform = `translate(-50%, -50%) rotate(${this.currentAngle}deg)`;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        this.rafId = undefined;
        return;
      }
      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  private updateTargetAngle(mouseX: number, mouseY: number): void {
    const button = this.demoBtn?.nativeElement;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    const angle = Math.atan2(targetY - mouseY, targetX - mouseX) * (180 / Math.PI);
    this.targetAngle = angle;
  }
}
