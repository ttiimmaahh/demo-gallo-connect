import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { provideHttpClient, withFetch, withInterceptorsFromDi } from "@angular/common/http";
import { EffectsModule } from "@ngrx/effects";
import { StoreModule } from "@ngrx/store";
import { AppRoutingModule } from "@spartacus/storefront";
import { MarkdownModule } from 'ngx-markdown';
import { AppComponent } from './app.component';
import { SpartacusModule } from './spartacus/spartacus.module';
import { ChatbotModule } from './components/chatbot/chatbot.module';

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
    MarkdownModule.forRoot(),
    SpartacusModule,
    ChatbotModule
  ],
  providers: [provideHttpClient(withFetch(), withInterceptorsFromDi())],
  bootstrap: [AppComponent]
})
export class AppModule { }
