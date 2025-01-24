//types.ts
/**
 * Represents the context of a sentence within the article
 */
export interface ArticleContext {
    section: string;
    subsection?: string;
    paragraph: string;
  }
  
  /**
   * Metadata about a specific sentence
   */
  export interface ArticleMetadata {
    isBulletPoint: boolean;
    isHeading: boolean;
  }
  
  /**
   * Represents a single sentence from the article with its context and metadata
   */
  export interface ArticleSentence {
    id: string;
    text: string;
    context: ArticleContext;
    metadata: ArticleMetadata;
  }
  
  /**
   * Represents the entire processed article
   */
  export interface ProcessedArticle {
    metadata: {
      title: string;
      language: string;
      processingDate: string;
    };
    sentences: ArticleSentence[];
  }