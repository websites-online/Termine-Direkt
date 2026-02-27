import { Routes } from '@angular/router';

import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { RestaurantPageComponent } from './pages/restaurant-page/restaurant-page.component';
import { DemoUnternehmenComponent } from './pages/demo-unternehmen/demo-unternehmen.component';
import { ImpressumComponent } from './pages/impressum/impressum.component';
import { DatenschutzComponent } from './pages/datenschutz/datenschutz.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { adminGuard } from './guards/admin.guard';
import { CompanyLoginComponent } from './pages/company-login/company-login.component';
import { CompanyDashboardComponent } from './pages/company-dashboard/company-dashboard.component';
import { companyGuard } from './guards/company.guard';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    pathMatch: 'full'
  },
  {
    path: 'demo-unternehmen',
    component: DemoUnternehmenComponent
  },
  {
    path: 'impressum',
    component: ImpressumComponent
  },
  {
    path: 'datenschutz',
    component: DatenschutzComponent
  },
  {
    path: 'admin/login',
    component: AdminLoginComponent
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'unternehmen/login',
    component: CompanyLoginComponent
  },
  {
    path: 'unternehmen',
    component: CompanyDashboardComponent,
    canActivate: [companyGuard]
  },
  {
    path: 'r/:slug',
    component: RestaurantPageComponent
  },
  {
    path: ':slug',
    component: RestaurantPageComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
