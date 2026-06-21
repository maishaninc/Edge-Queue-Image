export type GalleryImage = {
  id: string;
  url: string;
  title: string;
  prompt?: string;
};

// 生成100张示例图片数据（使用 YouMind prompt gallery 的图片）
export const GALLERY_IMAGES: GalleryImage[] = [
  {
    id: '1',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/11/00d2dae5-2d9b-4c32-b231-194e79bbac1d.webp',
    title: 'Stylized character portrait',
    prompt: 'A stylized character portrait with vibrant colors',
  },
  {
    id: '2',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/11/2e420771-2b02-4105-8759-0fbfa1eff917.webp',
    title: 'Editorial concept image',
    prompt: 'Editorial concept with modern aesthetics',
  },
  {
    id: '3',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/10/909e6b70-f1f8-45b1-9f8e-d0fb556d007a.webp',
    title: 'Product-ready render',
    prompt: 'Product render with professional lighting',
  },
  {
    id: '4',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/10/5a66de37-7347-4f24-9417-99e4e4a1fbe2.webp',
    title: 'Cinematic scene',
    prompt: 'Cinematic wide shot with dramatic composition',
  },
  {
    id: '5',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/10/61a6e5b5-b16e-4037-9f4c-ee5c58cd4002.webp',
    title: 'Poster composition',
    prompt: 'Movie poster style composition',
  },
  {
    id: '6',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/10/908a598c-cc0b-4a3d-b4f3-fc041067b800.webp',
    title: 'Fashion image prompt',
    prompt: 'High fashion editorial photography',
  },
  {
    id: '7',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/10/924f4d1e-c4f4-4f3c-a329-f94ef12cdea1.webp',
    title: 'Creative visual study',
    prompt: 'Abstract creative visual exploration',
  },
  {
    id: '8',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/9/1aef5f9e-415a-456f-ae62-fd0211d4fef2.webp',
    title: 'Design prompt sample',
    prompt: 'Modern design with clean aesthetics',
  },
  {
    id: '9',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/9/1d3987fe-f5dd-47af-aa75-b24ca884160c.webp',
    title: 'Illustration prompt sample',
    prompt: 'Digital illustration with vibrant colors',
  },
  {
    id: '10',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/9/74178fe8-b28e-493a-97c6-e28f6877232b.webp',
    title: 'Commercial prompt sample',
    prompt: 'Commercial photography style',
  },
  {
    id: '11',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/9/0952e4be-98b5-4a6a-a3a3-f7d2cf542e99.webp',
    title: 'Character prompt sample',
    prompt: 'Character design with detailed features',
  },
  {
    id: '12',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/9/488cb6bd-a393-47b4-9ef6-ee7c8e3565e7.webp',
    title: 'Scene prompt sample',
    prompt: 'Environmental scene with atmosphere',
  },
  {
    id: '13',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/8/4c1b94dd-d5c3-4317-9aab-c3f855b2c0f6.webp',
    title: 'Image editing prompt',
    prompt: 'Photo manipulation and editing',
  },
  {
    id: '14',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/8/5ba62a6f-0075-44c1-b1da-e21a27e4db9d.webp',
    title: 'Prompt reference image',
    prompt: 'Reference image for inspiration',
  },
  {
    id: '15',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/7/4b7598e1-952f-447e-b5b0-8727d0865032.webp',
    title: 'Visual prompt reference',
    prompt: 'Visual reference with artistic style',
  },
  {
    id: '16',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/7/80e02d23-7f30-40a6-b762-c06d4e3e47b9.webp',
    title: 'Gallery prompt reference',
    prompt: 'Gallery-ready artwork',
  },
  {
    id: '17',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/6/9e8def17-20df-4d0d-b849-dc2b1b49a1ea.webp',
    title: 'Prompt gallery image',
    prompt: 'Curated gallery image',
  },
  {
    id: '18',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/5/6930bc4e-bf53-479d-b130-733b4b6defc5.webp',
    title: 'Creative prompt reference',
    prompt: 'Creative concept exploration',
  },
  {
    id: '19',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/5/bd86d12e-1509-438c-b2f0-fb2b15805f3c.webp',
    title: 'Community prompt reference',
    prompt: 'Community-shared inspiration',
  },
  {
    id: '20',
    url: 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/images/2025/7/5/f6d2b7e4-df74-4c1d-b113-8a61ff4cbac4.webp',
    title: 'GPT image prompt reference',
    prompt: 'GPT-generated image reference',
  },
];

// 复制图片数据以生成100张（5组20张）
export function getGalleryImages(): GalleryImage[] {
  const images: GalleryImage[] = [];
  for (let i = 0; i < 5; i++) {
    GALLERY_IMAGES.forEach((img, index) => {
      images.push({
        ...img,
        id: `${img.id}-${i}-${index}`,
      });
    });
  }
  return images;
}
