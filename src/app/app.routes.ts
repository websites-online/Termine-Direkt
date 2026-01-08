import { Routes } from '@angular/router';

import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { RestaurantPageComponent } from './pages/restaurant-page/restaurant-page.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    pathMatch: 'full'
  },
  {
    path: 'r/:slug',
    component: RestaurantPageComponent
  }
];
