import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CompanyAuthService } from '../services/company-auth.service';

export const companyGuard: CanActivateFn = () => {
  const authService = inject(CompanyAuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/unternehmen/login']);
};
