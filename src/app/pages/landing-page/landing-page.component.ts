import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';

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
export class LandingPageComponent implements OnInit {
  isNavOpen = false;
  isNavCompact = false;
  scrollProgress = 0;
  pointerTiltX = 0;
  pointerTiltY = 0;
  private viewportFrame = 0;
  private pointerFrame = 0;
  private lastPointerEvent: MouseEvent | null = null;

  ngOnInit(): void {
    this.updateViewportEffects();
  }

  toggleNav(): void {
    this.isNavOpen = !this.isNavOpen;
  }

  closeNav(): void {
    this.isNavOpen = false;
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateViewportEffects(): void {
    if (this.viewportFrame) {
      return;
    }

    this.viewportFrame = window.requestAnimationFrame(() => {
      this.viewportFrame = 0;
      this.applyViewportEffects();
    });
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (window.innerWidth < 900) {
      return;
    }

    this.lastPointerEvent = event;

    if (this.pointerFrame) {
      return;
    }

    this.pointerFrame = window.requestAnimationFrame(() => {
      this.pointerFrame = 0;
      this.applyPointerTilt();
    });
  }

  private applyViewportEffects(): void {
    const scrollRange = Math.max(window.innerHeight * 1.8, 1200);
    const normalized = Math.min(window.scrollY / scrollRange, 1);
    this.scrollProgress = Number(normalized.toFixed(4));
    this.isNavCompact = window.scrollY > 24;

    if (window.innerWidth < 900) {
      this.pointerTiltX = Number((Math.sin(normalized * Math.PI * 2) * 0.22).toFixed(4));
      this.pointerTiltY = Number(((normalized - 0.5) * 0.5).toFixed(4));
    }
  }

  private applyPointerTilt(): void {
    if (!this.lastPointerEvent) {
      return;
    }

    const x = this.lastPointerEvent.clientX / window.innerWidth;
    const y = this.lastPointerEvent.clientY / window.innerHeight;
    this.pointerTiltX = Number(((x - 0.5) * 2).toFixed(4));
    this.pointerTiltY = Number(((y - 0.5) * 2).toFixed(4));
  }
}
