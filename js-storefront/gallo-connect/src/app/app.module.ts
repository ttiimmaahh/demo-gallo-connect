import { NgModule, SecurityContext } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { provideHttpClient, withFetch, withInterceptorsFromDi } from "@angular/common/http";
import { EffectsModule } from "@ngrx/effects";
import { StoreModule } from "@ngrx/store";
import { AppRoutingModule } from "@spartacus/storefront";
import { MarkdownModule } from 'ngx-markdown';
import { AppComponent } from './app.component';
import { SpartacusModule } from './spartacus/spartacus.module';
import { SmartEditModule } from '@spartacus/smartedit';
import { ChatbotModule } from './components/chatbot/chatbot.module';
import { HeroBannerModule } from './components/hero-banner/hero-banner.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    StoreModule.forRoot({}),
    AppRoutingModule,
    EffectsModule.forRoot([]),
    MarkdownModule.forRoot({
      sanitize: SecurityContext.NONE // We trust the LLM content, enhanced styling via CSS
    }),
    SpartacusModule,
    SmartEditModule,
    ChatbotModule,
    HeroBannerModule
  ],
  providers: [provideHttpClient(withFetch(), withInterceptorsFromDi())],
  bootstrap: [AppComponent]
})
export class AppModule { }
