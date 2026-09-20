---
title: 日常
layout: page
comments: false
---

{% raw %}
<link rel="stylesheet" href="/css/gallery.css">

<div class="gallery-page" id="gallery-page">

  <div class="gallery-toolbar">
    <button id="gallery-publish-btn" class="gallery-publish-btn">
      <i class="fas fa-plus"></i> 发布
    </button>
  </div>

  <div class="gallery-feed" id="gallery-feed">
    <div class="gallery-empty">正在加载…</div>
  </div>

  <div class="gallery-publish-panel" id="gallery-publish-panel">
    <div class="gallery-panel-box">
      <div class="gallery-panel-head">
        <span id="gallery-panel-title">发布新动态</span>
        <a href="javascript:;" id="gallery-panel-close">×</a>
      </div>
      <div class="gallery-panel-body">
        <label class="gallery-upload-zone" id="gallery-upload-zone">
          <input type="file" id="gallery-file-input" accept="image/*" multiple hidden>
          <div class="gallery-upload-hint">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>点击选择图片（可多张）</p>
          </div>
          <div class="gallery-upload-preview" id="gallery-upload-preview"></div>
        </label>
        <textarea id="gallery-text-input" placeholder="写点什么……（碎碎念/拍摄记录/心情）"></textarea>
      </div>
      <div class="gallery-panel-foot">
        <span class="gallery-panel-tip" id="gallery-panel-tip">自动压缩 webp + 更新页面</span>
        <button id="gallery-panel-submit" class="gallery-submit-btn">发布</button>
      </div>
    </div>
  </div>

</div>

<script src="/js/gallery.js" defer></script>
{% endraw %}
