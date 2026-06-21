'use client';

import { useEffect, useState, useMemo } from 'react';

type GalleryImage = {
  id: string;
  url: string;
  title: string;
  prompt?: string;
};

type ImageGalleryCarouselProps = {
  images: GalleryImage[];
  onImageClick?: (image: GalleryImage) => void;
};

// 生成一个12图布局配置，包含1个大图(2x2)、1个长图(2x1)、10个小图(1x1)
function generateLayoutConfig(groupIndex: number): Array<{ size: 'large' | 'wide' | 'normal' }> {
  const configs = [
    // 配置1: 大图在索引0 (左上), 长图在索引3
    [
      { size: 'large' as const }, // 0: 大图
      { size: 'normal' as const }, // 1
      { size: 'normal' as const }, // 2
      { size: 'wide' as const }, // 3: 长图
      { size: 'normal' as const }, // 4
      { size: 'normal' as const }, // 5
      { size: 'normal' as const }, // 6
      { size: 'normal' as const }, // 7
      { size: 'normal' as const }, // 8
      { size: 'normal' as const }, // 9
      { size: 'normal' as const }, // 10
      { size: 'normal' as const }, // 11
    ],
    // 配置2: 大图在索引2 (右上), 长图在索引4
    [
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'large' as const }, // 大图
      { size: 'normal' as const },
      { size: 'wide' as const }, // 长图
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
    ],
    // 配置3: 大图在索引4 (左中), 长图在索引8
    [
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'large' as const }, // 大图
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'wide' as const }, // 长图
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
    ],
    // 配置4: 大图在索引8 (右下), 长图在索引0
    [
      { size: 'wide' as const }, // 长图
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'normal' as const },
      { size: 'large' as const }, // 大图
      { size: 'normal' as const },
    ],
  ];

  return configs[groupIndex % configs.length];
}

export default function ImageGalleryCarousel({ images, onImageClick }: ImageGalleryCarouselProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // 将100张图片分成多个12张的组
  const imageGroups = useMemo(() => {
    const groups: GalleryImage[][] = [];
    for (let i = 0; i < images.length; i += 12) {
      groups.push(images.slice(i, Math.min(i + 12, images.length)));
    }
    return groups;
  }, [images]);

  const handleImageClick = (image: GalleryImage) => {
    setSelectedImage(image);
    onImageClick?.(image);
  };

  return (
    <section className="infinite-gallery-section">
      <div className="gallery-container">
        <div className="gallery-scroll-wrapper">
          {/* 左侧轮播 */}
          <div className="gallery-column gallery-column-left">
            {[...imageGroups, ...imageGroups].map((group, groupIndex) => {
              const layout = generateLayoutConfig(groupIndex);
              return (
                <div key={`left-${groupIndex}`} className="gallery-group">
                  {group.map((image, imageIndex) => {
                    const config = layout[imageIndex] || { size: 'normal' as const };
                    return (
                      <button
                        key={`${image.id}-${groupIndex}-${imageIndex}`}
                        type="button"
                        className={`gallery-item gallery-item-${config.size}`}
                        onClick={() => handleImageClick(image)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={image.title} loading="lazy" />
                        <div className="gallery-item-overlay">
                          <span>{image.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* 右侧轮播 */}
          <div className="gallery-column gallery-column-right">
            {[...imageGroups, ...imageGroups].map((group, groupIndex) => {
              const layout = generateLayoutConfig(groupIndex + 2); // 偏移配置以获得不同布局
              return (
                <div key={`right-${groupIndex}`} className="gallery-group">
                  {group.map((image, imageIndex) => {
                    const config = layout[imageIndex] || { size: 'normal' as const };
                    return (
                      <button
                        key={`${image.id}-${groupIndex}-${imageIndex}`}
                        type="button"
                        className={`gallery-item gallery-item-${config.size}`}
                        onClick={() => handleImageClick(image)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={image.title} loading="lazy" />
                        <div className="gallery-item-overlay">
                          <span>{image.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-card preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedImage.title}</h2>
                {selectedImage.prompt && <p>{selectedImage.prompt}</p>}
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedImage(null)} aria-label="关闭">
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="preview-image" src={selectedImage.url} alt={selectedImage.title} />
          </div>
        </div>
      )}
    </section>
  );
}
