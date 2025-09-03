import { Component, OnDestroy, OnInit, Inject, Optional } from '@angular/core';
import { CmsComponentData } from '@spartacus/storefront';
import { CmsBannerComponent, CmsBannerComponentMedia, CmsResponsiveBannerComponentMedia, OccConfig, CmsService } from '@spartacus/core';
import { Observable, of, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'cx-banner',
    templateUrl: './hero-banner.component.html',
    styleUrls: ['./hero-banner.component.scss'],
    standalone: false
})
export class HeroBannerComponent implements OnInit, OnDestroy {
    // Observable to hold the component data from the CMS
    data$: Observable<CmsBannerComponent> = of(null as unknown as CmsBannerComponent);
    occBaseUrl: string = '';
    isHeroBanner: boolean = false;

    private subscription = new Subscription();

    // Inject the CmsComponentData, OccConfig, and CmsService
    constructor(
        public component: CmsComponentData<CmsBannerComponent>,
        private occConfig: OccConfig,
        @Optional() private cmsService: CmsService
    ) { }

    ngOnInit(): void {
        // Assign the data stream from the injected service
        this.data$ = this.component.data$;

        // Get the OCC backend base URL from configuration
        this.occBaseUrl = this.occConfig.backend?.occ?.baseUrl || '';

        // Determine if this should be treated as a hero banner
        this.subscription.add(
            this.data$.subscribe(data => {
                if (data) {
                    this.isHeroBanner = this.shouldRenderAsHero(data);
                }
            })
        );
    }

    // Determine if this banner should be rendered as a hero banner
    private shouldRenderAsHero(data: CmsBannerComponent): boolean {
        console.log('data: ', data);

        // Check if this component has the specific characteristics of the hero banner
        const hasMedia = !!data.media;
        
        // Check for specific component UID or media URL that matches the homepage hero
        let isHomepageHero = false;

        if (data.uid === 'GalloConnectHompageSplashBannerComponent') {
            isHomepageHero = true;
        }
        
        console.log('Hero Detection Result:', {
            hasMedia,
            isHomepageHero,
            container: data.container,
            mediaUrl: data.media ? this.getMediaUrl(data.media) : 'none'
        });
        
        return isHomepageHero;
    }

    // Helper function to get the best media URL based on screen size
    getMediaUrl(media: CmsBannerComponentMedia | CmsResponsiveBannerComponentMedia | undefined): string {
        if (!media) {
            return 'https://via.placeholder.com/1200x400.png/007bff/ffffff?text=No+Image';
        }

        let imageUrl: string | undefined;

        // Check if it's responsive media (has desktop, mobile, etc.)
        if ('desktop' in media || 'widescreen' in media) {
            const responsiveMedia = media as CmsResponsiveBannerComponentMedia;
            // Prefer widescreen, then desktop, then tablet, then mobile
            imageUrl = responsiveMedia.widescreen?.url || 
                      responsiveMedia.desktop?.url || 
                      responsiveMedia.tablet?.url || 
                      responsiveMedia.mobile?.url;
        } else {
            // Simple media object with direct URL
            const simpleMedia = media as CmsBannerComponentMedia;
            imageUrl = simpleMedia.url;
        }

        return this.buildImageUrl(imageUrl);
    }

    // Helper function to build the full image URL using OCC backend baseUrl
    private buildImageUrl(url: string | undefined): string {
        if (url && this.occBaseUrl) {
            // CMS media URLs are often relative, so we prepend the OCC backend base URL
            return url.startsWith('http') ? url : this.occBaseUrl + url;
        }
        // Return a placeholder if no URL is found
        return 'https://via.placeholder.com/1200x400.png/007bff/ffffff?text=No+Image';
    }

    // Handle button click events
    onButtonClick(): void {
        // Add any custom tracking or analytics here
        console.log('Hero banner button clicked');
    }

    ngOnDestroy(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}