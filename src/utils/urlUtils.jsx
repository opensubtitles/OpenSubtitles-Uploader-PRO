/**
 * Utility functions for opening URLs in both web and Tauri environments
 */

/**
 * Opens a URL in external browser/app
 * Works in both web browsers and Tauri desktop apps
 * @param {string} url - URL to open
 * @returns {Promise<boolean>} - Success status
 */
export const openExternal = async (url) => {
  try {
    // Enhanced Tauri environment detection
    const isTauri = (
      typeof window !== 'undefined' && 
      (window.__TAURI__ !== undefined || 
       window.location.protocol === 'tauri:' ||
       window.location.origin.startsWith('tauri://'))
    );
    
    console.log('🔍 Environment detection:', {
      isTauri,
      hasTauriGlobal: typeof window !== 'undefined' && !!window.__TAURI__,
      protocol: window.location.protocol,
      origin: window.location.origin,
      userAgent: navigator.userAgent
    });
    
    if (isTauri) {
      console.log('🔗 Opening URL in Tauri environment:', url);
      
      try {
        // Try multiple Tauri shell import methods
        let shellOpen;
        
        try {
          // Method 1: Direct import
          const shell = await import('@tauri-apps/plugin-shell');
          shellOpen = shell.open;
          console.log('✅ Tauri shell imported via direct import');
        } catch (importError) {
          console.log('⚠️ Direct import failed, trying window.__TAURI__:', importError.message);
          
          // Method 2: Use window.__TAURI__ if available
          if (window.__TAURI__?.shell?.open) {
            shellOpen = window.__TAURI__.shell.open;
            console.log('✅ Using window.__TAURI__.shell.open');
          } else {
            throw new Error('No Tauri shell API available');
          }
        }
        
        if (shellOpen) {
          await shellOpen(url);
          console.log('✅ URL opened successfully via Tauri shell');
          return true;
        } else {
          throw new Error('Tauri shell.open function not found');
        }
        
      } catch (tauriError) {
        console.error('❌ Tauri shell failed:', tauriError);
        throw tauriError; // Re-throw to trigger fallback
      }
    } else {
      // Fallback to standard web browser behavior
      console.log('🔗 Opening URL in web browser:', url);
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to open URL via Tauri shell:', error);
    
    // Fallback to window.open even in Tauri if shell fails
    try {
      console.log('🔗 Fallback: Attempting window.open for URL:', url);
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      return false;
    }
  }
};

/**
 * Creates a click handler for opening external URLs
 * @param {string} url - URL to open
 * @returns {Function} - Click handler function
 */
export const createExternalLinkHandler = (url) => {
  return async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('🔗 External link handler triggered for:', url);
    const success = await openExternal(url);
    
    if (!success) {
      console.warn('⚠️ Could not open external URL:', url);
    }
  };
};

/**
 * Creates an enhanced anchor element that works in both web and Tauri
 * @param {Object} props - Anchor props
 * @param {string} props.href - URL to open
 * @param {string} props.children - Link text
 * @param {string} props.className - CSS classes
 * @returns {JSX.Element} - Enhanced anchor element
 */
export const ExternalLink = ({ href, children, className = '', ...props }) => {
  const handleClick = createExternalLinkHandler(href);
  
  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
};