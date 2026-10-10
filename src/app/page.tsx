import { AtomExperience } from "@/components/atom-experience";
import { LanguageProvider } from "@/components/language-provider";

export default function Home() {
  return (
    <LanguageProvider>
      <AtomExperience />
    </LanguageProvider>
  );
}
