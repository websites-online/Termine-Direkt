import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CompanyService } from '../../services/company.service';
@Component({
  selector: 'app-restaurant-page',
  standalone: true,
  templateUrl: './restaurant-page.component.html',
  styleUrl: './restaurant-page.component.css'
})
export class RestaurantPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly companyService = inject(CompanyService);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly company = this.companyService.findBySlug(this.slug);
}
