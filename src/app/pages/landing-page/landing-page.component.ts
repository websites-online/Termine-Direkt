import { Component } from '@angular/core';

import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { HeroSectionComponent } from '../../components/hero-section/hero-section.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { ContactFormComponent } from '../../components/contact-form/contact-form.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    BenefitsComponent,
    ContactFormComponent,
    FaqComponent,
    FooterComponent,
    HeroSectionComponent,
    HowItWorksComponent,
    PricingComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {}
