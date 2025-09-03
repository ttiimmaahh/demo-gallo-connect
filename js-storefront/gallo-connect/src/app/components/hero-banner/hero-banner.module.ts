import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CmsConfig, ConfigModule, I18nModule } from '@spartacus/core';
import { MediaModule } from '@spartacus/storefront';
import { HeroBannerComponent } from './hero-banner.component';

@NgModule({
  declarations: [
    HeroBannerComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    MediaModule,
    I18nModule,
    ConfigModule.withConfig({
      cmsComponents: {
        BannerComponent: {
          component: HeroBannerComponent
        }
      }
    } as CmsConfig)
  ],
  exports: [
    HeroBannerComponent
  ]
})
export class HeroBannerModule { }
