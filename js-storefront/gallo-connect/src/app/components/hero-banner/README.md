# Hero Banner Component

This custom hero banner component replaces the default Spartacus banner component (cx-banner) to provide text and button overlay functionality over hero images. It uses the same selector as the original banner component to ensure seamless integration.

## Features

- **Text Overlay**: Displays headline and content text over the hero image
- **Call-to-Action Button**: Customizable button with hover effects
- **Responsive Design**: Adapts to different screen sizes
- **Accessibility Compliant**: Includes proper ARIA labels and semantic HTML
- **High Contrast Support**: Enhanced visibility for users with visual impairments
- **Reduced Motion Support**: Respects user's motion preferences

## Usage

The component automatically replaces the default Spartacus `BannerComponent` when the `HeroBannerModule` is imported.

### CMS Content Structure

The component expects the following data structure from the CMS:

```typescript
{
  headline: string;        // Main title text
  content: string;         // Subtitle/description text (supports HTML)
  media: {                 // Hero image
    url: string;
    altText?: string;
  };
  urlLink: string;         // Button destination URL
}
```

### Styling Customization

The component uses CSS custom properties that can be overridden:

```scss
:root {
  --cx-color-primary: #your-brand-color;
  --cx-color-secondary: #your-secondary-color;
}
```

### Component Mapping

The component is automatically mapped to replace `BannerComponent` in the CMS configuration:

```typescript
{
  cmsComponents: {
    BannerComponent: {
      component: HeroBannerComponent
    }
  }
}
```

## Accessibility Features

- Semantic HTML structure with proper headings
- ARIA labels for interactive elements
- High contrast mode support
- Keyboard navigation support
- Screen reader friendly
- Respects user's motion preferences

## Responsive Breakpoints

- **Mobile (xs)**: 50vh height, optimized text sizes
- **Tablet (sm)**: 55vh height, medium text sizes
- **Desktop (md+)**: 60vh height, full text sizes

## Browser Support

Compatible with all modern browsers supported by Angular 19 and Spartacus 2211.43.0.

## Dependencies

- Angular 19+
- Spartacus Core 2211.43.0+
- Spartacus Storefront 2211.43.0+
