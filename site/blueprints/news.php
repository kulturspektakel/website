<?php if(!defined('KIRBY')) exit ?>

title: News
pages: true
  sort: flip
files: true
fields:
  title:
    label: Title
    type:  text
  date:
    label: Datum
    type: date
  text:
    label: Text
    type: textarea
    size: large
